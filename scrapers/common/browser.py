"""Sessão de browser real (Playwright + Chrome) para sites com anti-bot em JS.

Alguns sites (ex.: IPO Porto) servem um desafio JavaScript que só é resolvido
por um browser real. O Chromium *headless* falha as verificações do anti-bot,
por isso lançamos o Chrome completo em modo *headful* sob um display virtual
(Xvfb), iniciado automaticamente quando não existe DISPLAY.
"""

from __future__ import annotations

import atexit
import asyncio
import os
import shutil
import subprocess
import time

DEFAULT_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36"
)


def _chrome_executable() -> str | None:
    """Caminho para um Chrome real, se configurado; senão usa o do Playwright."""
    for env in ("PLAYWRIGHT_CHROME_BIN", "GOOGLE_CHROME_BIN", "CHROME_BIN"):
        path = os.environ.get(env)
        if path and os.path.exists(path):
            return path
    return None


def _xvfb_bin() -> str | None:
    for candidate in ("Xvfb", "/usr/bin/Xvfb"):
        path = shutil.which(candidate) if not candidate.startswith("/") else candidate
        if path and os.path.exists(path) and os.access(path, os.X_OK):
            return path
    return None


def _display_alive(display: str | None) -> bool:
    """True se o DISPLAY aponta para um servidor X utilizável."""
    if not display:
        return False
    if shutil.which("xdpyinfo"):
        try:
            result = subprocess.run(
                ["xdpyinfo", "-display", display],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=2,
                check=False,
            )
            return result.returncode == 0
        except Exception:
            return False
    # Fallback sem xdpyinfo: socket Unix do X11 (:99 → /tmp/.X11-unix/X99).
    if display.startswith(":"):
        num = display[1:].split(".", 1)[0]
        if num.isdigit():
            return os.path.exists(f"/tmp/.X11-unix/X{num}")
    return False


def _reset_asyncio_loop() -> None:
    """Evita 'Sync API inside the asyncio loop' após um launch Playwright falhado."""
    try:
        asyncio.get_running_loop()
        return
    except RuntimeError:
        pass
    try:
        old = asyncio.get_event_loop_policy().get_event_loop()
    except RuntimeError:
        old = None
    if old is not None and not old.is_closed():
        try:
            old.close()
        except Exception:
            pass
    try:
        asyncio.set_event_loop(asyncio.new_event_loop())
    except Exception:
        try:
            asyncio.set_event_loop(None)
        except Exception:
            pass


class _VirtualDisplay:
    """Arranca um Xvfb quando não há DISPLAY vivo, e limpa no fim.

    Ao parar, remove o DISPLAY do ambiente se fomos nós a defini-lo. Sem isso a
    próxima sessão reutiliza um DISPLAY morto e o Chrome falha com
    "Missing X server", deixando o Playwright Sync inconsistente.
    """

    def __init__(self) -> None:
        self._proc: subprocess.Popen | None = None
        self._display: str | None = None
        self._owned_display = False

    def start(self) -> None:
        current = os.environ.get("DISPLAY")
        if _display_alive(current):
            return
        if current:
            # DISPLAY órfão (Xvfb já morrido por uma sessão anterior).
            os.environ.pop("DISPLAY", None)

        xvfb = _xvfb_bin()
        if not xvfb:
            raise RuntimeError(
                "Sem DISPLAY e sem Xvfb. Instale xvfb ou corra com xvfb-run."
            )
        last_err = ""
        for num in range(99, 130):
            display = f":{num}"
            if _display_alive(display):
                continue
            try:
                proc = subprocess.Popen(
                    [
                        xvfb,
                        display,
                        "-screen",
                        "0",
                        "1366x900x24",
                        "-nolisten",
                        "tcp",
                        "-ac",
                    ],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.PIPE,
                )
            except OSError as exc:
                last_err = str(exc)
                continue
            # Dar tempo ao Xvfb a gravar o lock do display.
            for _ in range(20):
                if proc.poll() is not None:
                    break
                if os.path.exists(f"/tmp/.X{num}-lock") or os.path.exists(
                    f"/tmp/.X11-unix/X{num}"
                ):
                    self._proc = proc
                    self._display = display
                    os.environ["DISPLAY"] = display
                    self._owned_display = True
                    atexit.register(self.stop)
                    return
                time.sleep(0.1)
            # Falhou: limpa e tenta o próximo número.
            err = ""
            try:
                err = (proc.stderr.read() or b"").decode("utf-8", "replace")[:200]
            except Exception:
                pass
            last_err = err or f"Xvfb saiu com código {proc.poll()}"
            try:
                proc.kill()
            except Exception:
                pass
        raise RuntimeError(f"Não foi possível arrancar Xvfb. Último erro: {last_err}")

    def stop(self) -> None:
        if self._proc and self._proc.poll() is None:
            try:
                self._proc.terminate()
                self._proc.wait(timeout=5)
            except Exception:
                try:
                    self._proc.kill()
                except Exception:
                    pass
        self._proc = None
        if self._owned_display and self._display and os.environ.get("DISPLAY") == self._display:
            os.environ.pop("DISPLAY", None)
        elif self._owned_display and os.environ.get("DISPLAY", "").startswith(":"):
            os.environ.pop("DISPLAY", None)
        self._owned_display = False
        self._display = None


class BrowserSession:
    """Context manager que mantém um Chrome aberto e reutiliza cookies/desafio."""

    def __init__(
        self,
        *,
        user_agent: str = DEFAULT_UA,
        locale: str = "pt-PT",
        timeout_ms: int = 45000,
        min_interval: float = 1.0,
    ) -> None:
        self.user_agent = user_agent
        self.locale = locale
        self.timeout = timeout_ms
        self.min_interval = min_interval
        self._last = 0.0
        self._display = _VirtualDisplay()
        self._pw = None
        self._browser = None
        self._ctx = None
        self._page = None

    def __enter__(self) -> "BrowserSession":
        try:
            self._display.start()
            _reset_asyncio_loop()
            from playwright.sync_api import sync_playwright

            self._pw = sync_playwright().start()
            launch_kwargs: dict = {
                "headless": False,
                "args": [
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-blink-features=AutomationControlled",
                ],
            }
            chrome = _chrome_executable()
            if chrome:
                launch_kwargs["executable_path"] = chrome
            try:
                self._browser = self._pw.chromium.launch(**launch_kwargs)
            except Exception:
                # DISPLAY pode ter morrido entre start() e launch(); tenta 1x.
                self._display.stop()
                self._display.start()
                if not _display_alive(os.environ.get("DISPLAY")):
                    raise
                self._browser = self._pw.chromium.launch(**launch_kwargs)
            self._ctx = self._browser.new_context(
                user_agent=self.user_agent,
                locale=self.locale,
                viewport={"width": 1366, "height": 900},
            )
            self._ctx.add_init_script(
                "Object.defineProperty(navigator,'webdriver',{get:()=>undefined});"
            )
            self._page = self._ctx.new_page()
            return self
        except Exception:
            # Se o launch falhar a meio do __enter__, o `with` NÃO chama __exit__.
            # Sem esta limpeza o Playwright Sync fica com um loop asyncio activo
            # e as fontes seguintes rebentam com "Sync API inside the asyncio loop".
            self._force_close()
            raise

    def __exit__(self, *exc) -> None:
        self._force_close()

    def _force_close(self) -> None:
        for closer in (
            lambda: self._page and self._page.close(),
            lambda: self._ctx and self._ctx.close(),
            lambda: self._browser and self._browser.close(),
            lambda: self._pw and self._pw.stop(),
        ):
            try:
                closer()
            except Exception:
                pass
        self._page = None
        self._ctx = None
        self._browser = None
        self._pw = None
        try:
            self._display.stop()
        except Exception:
            pass
        _reset_asyncio_loop()

    def _throttle(self) -> None:
        elapsed = time.monotonic() - self._last
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)
        self._last = time.monotonic()

    def open(self, url: str, *, wait_selector: str | None = None, settle_ms: int = 1500, tries: int = 6) -> None:
        """Navega para `url` e espera o conteúdo real (passando o desafio JS)."""
        self._throttle()
        self._page.goto(url, wait_until="domcontentloaded", timeout=self.timeout)
        if wait_selector:
            for _ in range(tries):
                try:
                    self._page.wait_for_selector(wait_selector, timeout=6000)
                    return
                except Exception:
                    self._page.wait_for_timeout(2500)
        else:
            self._page.wait_for_timeout(settle_ms)

    def html(self) -> str:
        return self._page.content()

    def anchors(self, selector: str) -> list[dict]:
        """Devolve [{href, text}] para os links que casam com `selector`."""
        return self._page.eval_on_selector_all(
            selector,
            "els => els.map(e => ({href: e.href, text: (e.innerText || e.textContent || '').trim()}))",
        )

    def get_text(self, url: str, *, wait_selector: str | None = None, settle_ms: int = 1500) -> str:
        self.open(url, wait_selector=wait_selector, settle_ms=settle_ms)
        return self.html()
