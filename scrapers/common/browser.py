"""Sessão de browser real (Playwright + Chrome) para sites com anti-bot em JS.

Alguns sites (ex.: IPO Porto) servem um desafio JavaScript que só é resolvido
por um browser real. O Chromium *headless* falha as verificações do anti-bot,
por isso lançamos o Chrome completo em modo *headful* sob um display virtual
(Xvfb), iniciado automaticamente quando não existe DISPLAY.
"""

from __future__ import annotations

import atexit
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


class _VirtualDisplay:
    """Arranca um Xvfb quando não há DISPLAY, e limpa no fim."""

    def __init__(self) -> None:
        self._proc: subprocess.Popen | None = None

    def start(self) -> None:
        if os.environ.get("DISPLAY"):
            return
        if not shutil.which("Xvfb"):
            return
        for num in range(99, 120):
            display = f":{num}"
            try:
                proc = subprocess.Popen(
                    ["Xvfb", display, "-screen", "0", "1366x900x24", "-nolisten", "tcp"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            except Exception:
                return
            time.sleep(1.0)
            if proc.poll() is None:
                self._proc = proc
                os.environ["DISPLAY"] = display
                atexit.register(self.stop)
                return
            # Display ocupado: tenta o próximo.

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
        self._display.start()
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

    def __exit__(self, *exc) -> None:
        for closer in (
            lambda: self._ctx and self._ctx.close(),
            lambda: self._browser and self._browser.close(),
            lambda: self._pw and self._pw.stop(),
        ):
            try:
                closer()
            except Exception:
                pass
        self._display.stop()

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
