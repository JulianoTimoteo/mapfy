from __future__ import annotations

import logging
import os
import signal
import subprocess
import sys
import threading
import time
from typing import IO
from logging.handlers import RotatingFileHandler
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv

from runtime_paths import ENV_FILE, LEGACY_ENV_FILE, SERVER_DIR

TASK_NAME = "MapFyBackground"
LOG_FILE = SERVER_DIR / "mapfy_background.log"
PID_FILE = SERVER_DIR / "mapfy_background.pid"
LOCK_FILE = SERVER_DIR / "mapfy_background.lock"
STOP_FILE = SERVER_DIR / "mapfy_background.stop"
SERVER_PID_FILE = SERVER_DIR / "mapfy_server.pid"
SENTINEL_PID_FILE = SERVER_DIR / "sentinel_agent.pid"
SERVER_SCRIPT = SERVER_DIR / "mapfy_server.py"
SENTINEL_SCRIPT = SERVER_DIR / "sentinel_agent.py"
API_HOST = "127.0.0.1"
CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)
logger = logging.getLogger("mapfy.background")
stop_event = threading.Event()


def configure_logging() -> None:
    SERVER_DIR.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-8s | %(message)s",
        handlers=[
            RotatingFileHandler(
                LOG_FILE,
                maxBytes=2_000_000,
                backupCount=5,
                encoding="utf-8",
            )
        ],
        force=True,
    )


def is_process_running(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except (OSError, ValueError):
        return False
    return True


def read_pid(path: Path) -> int | None:
    try:
        pid = int(path.read_text(encoding="ascii").strip())
    except (OSError, ValueError):
        return None
    return pid if is_process_running(pid) else None


def api_base_url() -> str:
    configured_port = os.getenv("MAPFY_API_PORT", "8000").strip() or "8000"
    try:
        port = int(configured_port)
    except ValueError as exc:
        raise ValueError("MAPFY_API_PORT deve ser uma porta numérica.") from exc
    if not 1 <= port <= 65535:
        raise ValueError("MAPFY_API_PORT deve estar entre 1 e 65535.")
    return f"http://{API_HOST}:{port}"


def api_is_healthy(timeout: float = 2.0) -> bool:
    try:
        with urlopen(f"{api_base_url()}/api/v1/health", timeout=timeout) as response:
            return response.status == 200
    except (OSError, URLError, TimeoutError):
        return False


def sentinel_endpoint_configured() -> bool:
    return bool(os.getenv("MAPFY_SENTINEL_URL", "").strip())


def _process_command_line(pid: int) -> str:
    command = (
        "$p=Get-CimInstance Win32_Process -Filter 'ProcessId = "
        f"{pid}'; if($p){{[Console]::Out.Write($p.CommandLine)}}"
    )
    try:
        result = subprocess.run(
            [
                "powershell.exe",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                command,
            ],
            capture_output=True,
            text=True,
            timeout=8,
            creationflags=CREATE_NO_WINDOW,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return ""
    return result.stdout.strip() if result.returncode == 0 else ""


def _owned_process(pid: int | None, script_name: str) -> bool:
    if pid is None or not is_process_running(pid):
        return False
    command_line = _process_command_line(pid).casefold()
    return script_name.casefold() in command_line


def _start_service(script: Path, label: str) -> subprocess.Popen[bytes]:
    python_exe = Path(sys.executable).with_name("python.exe")
    if not python_exe.is_file():
        python_exe = Path(sys.executable)
    stderr_path = SERVER_DIR / f"{script.stem}.stderr.log"
    logger.info("Iniciando %s em segundo plano.", label)
    with stderr_path.open("ab") as stderr_file:
        return subprocess.Popen(
            [str(python_exe), "-u", str(script)],
            cwd=str(SERVER_DIR),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=stderr_file,
            creationflags=CREATE_NO_WINDOW,
        )


def _request_server_shutdown() -> None:
    request = Request(
        f"{api_base_url()}/api/v1/admin/shutdown",
        data=b"",
        method="POST",
    )
    try:
        with urlopen(request, timeout=5):
            logger.info("Solicitada parada graciosa da API MapFy.")
    except (OSError, URLError, TimeoutError):
        logger.info("API não respondeu ao pedido de parada graciosa.")


def _stop_child(
    process: subprocess.Popen[bytes] | None,
    label: str,
    timeout: float = 30,
) -> None:
    if process is None or process.poll() is not None:
        return
    logger.info("Aguardando encerramento de %s.", label)
    try:
        process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        logger.warning("%s não encerrou no prazo; finalizando apenas o processo gerenciado.", label)
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


def _write_pid() -> None:
    PID_FILE.write_text(str(os.getpid()), encoding="ascii")


def _acquire_instance_lock() -> IO[str] | None:
    lock_file = LOCK_FILE.open("a+", encoding="ascii")
    try:
        if os.name == "nt":
            import msvcrt

            lock_file.seek(0, os.SEEK_END)
            if lock_file.tell() == 0:
                lock_file.write(" ")
                lock_file.flush()
            lock_file.seek(0)
            msvcrt.locking(lock_file.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl

            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except (OSError, ImportError):
        lock_file.close()
        return None
    return lock_file


def _cleanup_pid() -> None:
    try:
        if PID_FILE.read_text(encoding="ascii").strip() == str(os.getpid()):
            PID_FILE.unlink()
    except OSError:
        logger.exception("Não foi possível remover o PID do supervisor.")


def _stop_unconfigured_sentinel() -> None:
    pid = read_pid(SENTINEL_PID_FILE)
    if pid is None or not _owned_process(pid, "sentinel_agent.py"):
        return
    logger.warning("Encerrando agente Sentinel existente sem MAPFY_SENTINEL_URL configurado.")
    try:
        os.kill(pid, signal.SIGTERM)
    except OSError:
        logger.exception("Falha ao encerrar o agente Sentinel sem receptor configurado.")
        return
    deadline = time.monotonic() + 10
    while is_process_running(pid) and time.monotonic() < deadline:
        time.sleep(0.2)
    if not is_process_running(pid):
        try:
            if SENTINEL_PID_FILE.read_text(encoding="ascii").strip() == str(pid):
                SENTINEL_PID_FILE.unlink()
        except OSError:
            logger.exception("Não foi possível remover o PID do agente Sentinel encerrado.")


def run() -> int:
    load_dotenv(ENV_FILE if ENV_FILE.is_file() else LEGACY_ENV_FILE)
    configure_logging()
    try:
        api_base_url()
    except ValueError:
        logger.exception("Configuração da porta da API inválida.")
        return 1

    instance_lock = _acquire_instance_lock()
    if instance_lock is None:
        logger.info("Supervisor MapFy já está em execução.")
        return 0

    existing_pid = read_pid(PID_FILE)
    if existing_pid is not None and _owned_process(existing_pid, "mapfy_background.py"):
        logger.info("Supervisor MapFy já está em execução (PID %s).", existing_pid)
        instance_lock.close()
        return 0

    STOP_FILE.unlink(missing_ok=True)
    _write_pid()
    server_process: subprocess.Popen[bytes] | None = None
    sentinel_process: subprocess.Popen[bytes] | None = None
    adopted_server_pid: int | None = None
    adopted_sentinel_pid: int | None = None
    server_unhealthy_since: float | None = None
    server_retry_at = 0.0
    sentinel_retry_at = 0.0
    server_backoff = 5.0
    sentinel_backoff = 5.0
    sentinel_enabled = sentinel_endpoint_configured()
    logger.info("Supervisor MapFy iniciado. A extração é executada pelo ciclo do servidor.")
    if not sentinel_enabled:
        _stop_unconfigured_sentinel()
        logger.warning(
            "Agente Sentinel não iniciado: configure MAPFY_SENTINEL_URL em server\\.env."
        )

    try:
        while not stop_event.is_set() and not STOP_FILE.exists():
            now = time.monotonic()
            server_running = server_process is not None and server_process.poll() is None

            if server_process is not None and not server_running:
                exit_code = server_process.returncode
                logger.error("Servidor MapFy encerrou (código %s).", exit_code)
                server_process = None
                server_retry_at = now + server_backoff
                server_backoff = min(server_backoff * 2, 300.0)

            if server_process is None and api_is_healthy():
                server_pid = read_pid(SERVER_PID_FILE)
                if adopted_server_pid != server_pid:
                    logger.info("API MapFy existente detectada e adotada pelo supervisor.")
                adopted_server_pid = server_pid
                server_unhealthy_since = None
            elif server_process is None:
                server_pid = read_pid(SERVER_PID_FILE)
                if server_pid and _owned_process(server_pid, "mapfy_server.py"):
                    server_unhealthy_since = server_unhealthy_since or now
                    if now - server_unhealthy_since >= 60:
                        logger.error(
                            "Servidor sem API saudável há 60 s; reiniciando somente o PID verificado %s.",
                            server_pid,
                        )
                        try:
                            os.kill(server_pid, signal.SIGTERM)
                        except OSError:
                            logger.exception("Falha ao solicitar encerramento do servidor travado.")
                        server_retry_at = now + 5
                        server_unhealthy_since = None
                elif adopted_server_pid is not None:
                    server_unhealthy_since = server_unhealthy_since or now
                    if now - server_unhealthy_since >= 60:
                        logger.warning("API MapFy permaneceu indisponível; iniciando nova instância.")
                        adopted_server_pid = None
                        server_unhealthy_since = None
                        server_retry_at = now
                elif now >= server_retry_at:
                    server_unhealthy_since = None
                    try:
                        server_process = _start_service(SERVER_SCRIPT, "servidor MapFy")
                        server_backoff = 5.0
                    except OSError:
                        logger.exception("Falha ao iniciar o servidor MapFy.")
                        server_retry_at = now + server_backoff
                        server_backoff = min(server_backoff * 2, 300.0)

            sentinel_running = sentinel_process is not None and sentinel_process.poll() is None
            if sentinel_process is not None and not sentinel_running:
                logger.error(
                    "Agente Sentinel encerrou (código %s); verifique %s.",
                    sentinel_process.returncode,
                    SERVER_DIR / "sentinel_agent.stderr.log",
                )
                sentinel_process = None
                sentinel_retry_at = now + sentinel_backoff
                sentinel_backoff = min(sentinel_backoff * 2, 300.0)

            if sentinel_enabled and sentinel_process is None and now >= sentinel_retry_at:
                sentinel_pid = read_pid(SENTINEL_PID_FILE)
                if sentinel_pid and _owned_process(sentinel_pid, "sentinel_agent.py"):
                    if adopted_sentinel_pid != sentinel_pid:
                        logger.info("Agente Sentinel existente detectado.")
                    adopted_sentinel_pid = sentinel_pid
                else:
                    adopted_sentinel_pid = None
                    try:
                        sentinel_process = _start_service(SENTINEL_SCRIPT, "agente Sentinel")
                        sentinel_backoff = 5.0
                    except OSError:
                        logger.exception("Falha ao iniciar o agente Sentinel.")
                        sentinel_retry_at = now + sentinel_backoff
                        sentinel_backoff = min(sentinel_backoff * 2, 300.0)

            stop_event.wait(5)
    except Exception:
        logger.exception("Falha inesperada no supervisor MapFy.")
        return 1
    finally:
        logger.info("Encerrando serviços supervisionados do MapFy.")
        if server_process is not None and server_process.poll() is None:
            _request_server_shutdown()
            _stop_child(server_process, "servidor MapFy")
        elif adopted_server_pid and api_is_healthy():
            _request_server_shutdown()
            deadline = time.monotonic() + 30
            while is_process_running(adopted_server_pid) and time.monotonic() < deadline:
                time.sleep(1)
            if is_process_running(adopted_server_pid) and _owned_process(
                adopted_server_pid,
                "mapfy_server.py",
            ):
                logger.warning("Finalizando o PID do servidor solicitado para parada.")
                try:
                    os.kill(adopted_server_pid, signal.SIGTERM)
                except OSError:
                    logger.exception("Falha ao finalizar o servidor adotado.")
        if sentinel_process is not None and sentinel_process.poll() is None:
            sentinel_process.terminate()
            _stop_child(sentinel_process, "agente Sentinel", timeout=10)
        elif adopted_sentinel_pid and _owned_process(
            adopted_sentinel_pid,
            "sentinel_agent.py",
        ):
            try:
                os.kill(adopted_sentinel_pid, signal.SIGTERM)
            except OSError:
                logger.exception("Falha ao finalizar o agente Sentinel adotado.")
        _cleanup_pid()
        instance_lock.close()
        logger.info("Supervisor MapFy encerrado.")
    return 0


def main() -> int:
    signal.signal(signal.SIGINT, lambda _signum, _frame: stop_event.set())
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, lambda _signum, _frame: stop_event.set())
    return run()


if __name__ == "__main__":
    raise SystemExit(main())
