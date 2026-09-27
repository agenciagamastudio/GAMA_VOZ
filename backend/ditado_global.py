#!/usr/bin/env python3
"""
GAMA Voz — Ditado Global (estilo Wispr Flow)

Segure Ctrl+Shift+Alt+Z em QUALQUER aplicativo do Windows e fale —
o texto vai sendo DIGITADO ao vivo onde o cursor estiver (Groq Whisper
via backend GAMA Voz). Ao soltar, a transcrição final corrige o texto.

Feedback visual: overlay no canto inferior direito com bolinha pulsante
e prévia do texto.

Requisitos: backend GAMA Voz rodando em http://127.0.0.1:8000
Uso: python ditado_global.py   (ou INICIAR_DITADO.bat na raiz do projeto)

Limitações conhecidas:
- Durante o ditado, não digite manualmente nem troque o foco de janela
  (a correção final iria para o lugar errado).
- Janelas rodando como Administrador só recebem o ditado se este script
  também rodar como Administrador.
- Apps que mapeiam Ctrl+Shift+Alt+Z como atalho próprio podem reagir ao
  auto-repeat da tecla durante o hold.
"""

import ctypes
import io
import queue
import re
import time
import threading
import tkinter as tk

import numpy as np
import sounddevice as sd
import soundfile as sf
import pyperclip
import requests
from pynput import keyboard as pk

KB = pk.Controller()

API_BASE = 'http://127.0.0.1:8000'
HOTKEY_VK = 0x5A                              # tecla Z (virtual-key code)
MOD_KEYS = {
    pk.Key.ctrl_l: 'ctrl', pk.Key.ctrl_r: 'ctrl',
    pk.Key.shift_l: 'shift', pk.Key.shift_r: 'shift', pk.Key.shift: 'shift',
    pk.Key.alt_l: 'alt', pk.Key.alt_r: 'alt', pk.Key.alt_gr: 'alt',
}
REQUIRED_MODS = {'ctrl', 'shift', 'alt'}
SAMPLE_RATE = 16000
MIN_DURATION_S = 0.4                          # descarta toques acidentais
LIVE_INTERVAL_S = 3.0                         # ciclo da transcrição ao vivo
BACKSPACE_DELAY_S = 0.03
PASTE_SETTLE_S = 0.15                         # pausa após cada Ctrl+V



COLOR_BG = '#161616'
COLOR_TEXT = '#eeeeee'
COLOR_MUTED = '#9a9a9a'
COLOR_GREEN = '#88ce11'
COLOR_AMBER = '#e8b423'
COLOR_RED = '#e11d48'


class Overlay:
    """Janela flutuante no canto inferior direito (roda na main thread do tk)."""

    def __init__(self, root: tk.Tk, events: queue.Queue):
        self.root = root
        self.events = events
        self.win = tk.Toplevel(root)
        self.win.overrideredirect(True)
        self.win.attributes('-topmost', True)
        self.win.attributes('-alpha', 0.93)
        self.win.configure(bg=COLOR_BG)
        self.win.withdraw()

        frame = tk.Frame(self.win, bg=COLOR_BG, padx=14, pady=10)
        frame.pack()
        top = tk.Frame(frame, bg=COLOR_BG)
        top.pack(anchor='w', fill='x')
        self.dot = tk.Canvas(top, width=14, height=14, bg=COLOR_BG, highlightthickness=0)
        self.dot_id = self.dot.create_oval(2, 2, 12, 12, fill=COLOR_GREEN, outline='')
        self.dot.pack(side='left')
        self.status = tk.Label(top, text='', font=('Segoe UI', 10, 'bold'),
                               fg=COLOR_TEXT, bg=COLOR_BG)
        self.status.pack(side='left', padx=(8, 0))
        self.live = tk.Label(frame, text='', font=('Segoe UI', 10),
                             fg=COLOR_MUTED, bg=COLOR_BG,
                             wraplength=330, justify='left')

        self._pulse_on = False
        self._pulse_job = None
        self._hide_job = None
        self._noactivate_done = False
        self._poll()
        self._pulse()

    def _make_noactivate(self):
        """WS_EX_NOACTIVATE: overlay NUNCA rouba o foco do app do usuário.

        Sem isso, o Windows pode focar o overlay ao exibi-lo — e os Ctrl+V
        ao vivo iriam para o overlay em vez do app onde o usuário digita.
        """
        if self._noactivate_done:
            return
        try:
            self.win.update_idletasks()
            hwnd = ctypes.windll.user32.GetParent(self.win.winfo_id())
            GWL_EXSTYLE = -20
            WS_EX_NOACTIVATE = 0x08000000
            style = ctypes.windll.user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
            ctypes.windll.user32.SetWindowLongW(hwnd, GWL_EXSTYLE, style | WS_EX_NOACTIVATE)
            self._noactivate_done = True
        except Exception:
            pass

    # ---------- posicionamento ----------
    def _place(self):
        self.win.update_idletasks()
        w = self.win.winfo_reqwidth()
        h = self.win.winfo_reqheight()
        sw = self.win.winfo_screenwidth()
        sh = self.win.winfo_screenheight()
        self.win.geometry(f'+{sw - w - 24}+{sh - h - 80}')

    # ---------- animação ----------
    def _pulse(self):
        self._pulse_on = not self._pulse_on
        current = self.dot.itemcget(self.dot_id, 'fill')
        if current == COLOR_GREEN or current == COLOR_BG:
            self.dot.itemconfig(self.dot_id, fill=COLOR_BG if self._pulse_on else COLOR_GREEN)
        self._pulse_job = self.root.after(450, self._pulse)

    def _cancel_hide(self):
        if self._hide_job:
            self.root.after_cancel(self._hide_job)
            self._hide_job = None

    # ---------- estados ----------
    def show_recording(self):
        self._cancel_hide()
        self.dot.itemconfig(self.dot_id, fill=COLOR_GREEN)
        self.status.config(text='Gravando — fale à vontade', fg=COLOR_TEXT)
        self.live.config(text='')
        self.live.pack_forget()
        self.win.deiconify()
        self._make_noactivate()
        self._place()

    def show_live(self, text: str):
        if not text:
            return
        # mostra só o final do texto (últimas ~220 chars) pra não crescer demais
        shown = text if len(text) <= 220 else '…' + text[-220:]
        self.live.config(text=shown)
        self.live.pack(anchor='w', pady=(6, 0))
        self._place()

    def show_transcribing(self):
        self.dot.itemconfig(self.dot_id, fill=COLOR_AMBER)
        self.status.config(text='Transcrevendo...', fg=COLOR_AMBER)
        self._place()

    def show_done(self, text: str):
        self.dot.itemconfig(self.dot_id, fill=COLOR_GREEN)
        self.status.config(text='✓ Colado', fg=COLOR_GREEN)
        shown = text if len(text) <= 120 else text[:120] + '…'
        self.live.config(text=shown)
        self.live.pack(anchor='w', pady=(6, 0))
        self._place()
        self._cancel_hide()
        self._hide_job = self.root.after(1400, self.hide)

    def show_error(self, msg: str):
        self.dot.itemconfig(self.dot_id, fill=COLOR_RED)
        self.status.config(text='Erro', fg=COLOR_RED)
        self.live.config(text=msg)
        self.live.pack(anchor='w', pady=(6, 0))
        self.win.deiconify()
        self._make_noactivate()
        self._place()
        self._cancel_hide()
        self._hide_job = self.root.after(2600, self.hide)

    def hide(self):
        self._cancel_hide()
        self.win.withdraw()

    # ---------- ponte thread-safe ----------
    def _poll(self):
        try:
            while True:
                kind, payload = self.events.get_nowait()
                if kind == 'recording':
                    self.show_recording()
                elif kind == 'live':
                    self.show_live(payload)
                elif kind == 'transcribing':
                    self.show_transcribing()
                elif kind == 'done':
                    self.show_done(payload)
                elif kind == 'error':
                    self.show_error(payload)
                elif kind == 'hide':
                    self.hide()
        except queue.Empty:
            pass
        self.root.after(50, self._poll)


class Paster:
    """Worker único que injeta texto por Ctrl+V em blocos (fila serializa live + final).

    `hold_active` indica se o usuário ainda segura Ctrl+Shift+Alt+Z: nesse caso,
    injeta key-UP sintético de Shift/Alt (o Ctrl físico completa o Ctrl+V).
    """

    def __init__(self):
        self.q: queue.Queue = queue.Queue()
        self.typed = ''       # o que REALMENTE já foi colado nesta sessão
        self.hold_active = False
        threading.Thread(target=self._run, daemon=True).start()

    def _clear_mods(self):
        """Zera o estado dos modificadores físicos segurados (ups sintéticos)."""
        if self.hold_active:
            KB.release(pk.Key.shift)
            KB.release(pk.Key.alt)
            KB.release(pk.Key.ctrl)
            time.sleep(0.05)

    def _paste_block(self, text: str):
        pyperclip.copy(text)
        time.sleep(0.08)
        self._clear_mods()
        with KB.pressed(pk.Key.ctrl):
            KB.tap('v')
        self.typed += text
        print(f'📋 Paste ({"hold" if self.hold_active else "final"}): {text[:50]!r}')
        time.sleep(PASTE_SETTLE_S)

    def _mirror(self, target: str):
        """Sincroniza o app com `target` (espelho do overlay): apaga o trecho
        divergente em bloco e cola só o que mudou/faltou."""
        typed = self.typed
        common = 0
        for a, b in zip(typed, target):
            if a != b:
                break
            common += 1
        to_delete = len(typed) - common
        if to_delete > 0:
            self._clear_mods()
            with KB.pressed(pk.Key.shift):
                for _ in range(to_delete):
                    KB.tap(pk.Key.left)
            time.sleep(0.05)
            KB.tap(pk.Key.backspace)
            self.typed = typed[:common]
            time.sleep(0.1)
        delta = target[common:]
        if delta:
            self._paste_block(delta)
        else:
            self.typed = target

    def _run(self):
        while True:
            kind, val = self.q.get()
            try:
                if kind == 'paste':
                    self._paste_block(val)
                elif kind == 'mirror':
                    self._mirror(val)
                elif kind == 'bs':
                    KB.tap(pk.Key.backspace)
                    self.typed = self.typed[:-1]
                    time.sleep(BACKSPACE_DELAY_S)
                elif kind == 'bulk_delete':
                    # seleciona N chars com Shift+← (sem delay) e apaga com 1 backspace
                    with KB.pressed(pk.Key.shift):
                        for _ in range(val):
                            KB.tap(pk.Key.left)
                    time.sleep(0.05)
                    KB.tap(pk.Key.backspace)
                    self.typed = self.typed[:-val] if val <= len(self.typed) else ''
                    time.sleep(0.1)
                elif kind == 'reset':
                    self.typed = ''
            except Exception:
                pass
            finally:
                self.q.task_done()

    def type_text(self, text: str):
        if text:
            self.q.put(('paste', text))

    def mirror(self, target: str):
        self.q.put(('mirror', target))

    def backspaces(self, n: int):
        for _ in range(n):
            self.q.put(('bs', None))

    def bulk_delete(self, n: int):
        if n > 0:
            self.q.put(('bulk_delete', n))

    def reset(self):
        self.q.put(('reset', None))

    def flush(self):
        """Bloqueia até tudo que foi enfileirado ser injetado."""
        self.q.join()


class Ditado:
    def __init__(self, events: queue.Queue):
        self.typer = Paster()
        self.events = events
        self.recording = False
        self.frames: list[np.ndarray] = []
        self.stream: sd.InputStream | None = None
        self.started_at = 0.0
        self.lock = threading.Lock()
        self.live_inflight = False
        self.session_seq = 0  # invalida workers de sessões antigas
        self.injected_text = ''  # o que já foi digitado no app nesta sessão

    # ---------- áudio ----------
    @staticmethod
    def _wav_bytes(frames) -> io.BytesIO:
        audio = np.concatenate(frames, axis=0)
        buf = io.BytesIO()
        sf.write(buf, audio, SAMPLE_RATE, format='WAV', subtype='PCM_16')
        buf.seek(0)
        return buf

    @staticmethod
    def _transcribe(buf: io.BytesIO, timeout=120) -> str:
        resp = requests.post(
            f'{API_BASE}/api/stt/transcribe',
            files={'audio': ('ditado.wav', buf, 'audio/wav')},
            data={'language': 'pt'},
            timeout=timeout,
        )
        resp.raise_for_status()
        return (resp.json().get('text') or '').strip()

    # ---------- transcrição ao vivo ----------
    def _inject_live(self, text: str, seq: int):
        """Espelha no app EXATAMENTE o texto do overlay (apaga/recola o que mudou)."""
        with self.lock:
            if not self.recording or seq != self.session_seq:
                return
            if text == self.injected_text:
                return
            self.injected_text = text
        self.typer.mirror(text)

    def _live_loop(self, seq: int):
        while True:
            time.sleep(LIVE_INTERVAL_S)
            with self.lock:
                if not self.recording or seq != self.session_seq:
                    return
                if self.live_inflight or not self.frames:
                    continue
                self.live_inflight = True
                frames = list(self.frames)
            try:
                text = self._transcribe(self._wav_bytes(frames), timeout=30)
                with self.lock:
                    still_active = self.recording and seq == self.session_seq
                if still_active and text:
                    self.events.put(('live', text))
                    self._inject_live(text, seq)
            except Exception:
                pass  # ciclo seguinte tenta de novo
            finally:
                self.live_inflight = False

    # ---------- controle ----------
    def start(self):
        with self.lock:
            if self.recording:
                return  # auto-repeat do Windows
            self.frames = []
            self.injected_text = ''
            self.typer.reset()
            self.typer.hold_active = True
            try:
                self.stream = sd.InputStream(
                    samplerate=SAMPLE_RATE, channels=1, dtype='float32',
                    callback=lambda indata, *_: self.frames.append(indata.copy())
                )
                self.stream.start()
            except Exception as e:
                self.events.put(('error', f'Microfone indisponível: {e}'))
                self.stream = None
                return
            self.recording = True
            self.session_seq += 1
            seq = self.session_seq
            self.started_at = time.time()
        self.events.put(('recording', None))
        threading.Thread(target=self._live_loop, args=(seq,), daemon=True).start()
        print('🎙 Gravando... (solte a tecla para transcrever)')

    def stop_and_transcribe(self):
        with self.lock:
            if not self.recording:
                return
            self.recording = False
            self.typer.hold_active = False  # teclas físicas soltas
            duration = time.time() - self.started_at
            try:
                if self.stream:
                    self.stream.stop()
                    self.stream.close()
            except Exception:
                pass
            self.stream = None
            frames = self.frames
            self.frames = []

        if duration < MIN_DURATION_S or not frames:
            self.events.put(('hide', None))
            print('⏭ Toque muito curto — ignorado.')
            return

        self.events.put(('transcribing', None))
        threading.Thread(target=self._finalize, args=(frames, duration), daemon=True).start()

    def _leave_transcript_in_clipboard(self, text: str):
        """Deixa a transcrição COMPLETA na área de transferência ao final.

        Rede de segurança: mesmo que o foco tenha mudado e os pastes tenham
        ido pro lugar errado, um Ctrl+V manual recupera todo o texto.
        """
        gen = self.session_seq

        def _copy():
            time.sleep(0.5)  # deixa o último Ctrl+V da sessão assentar
            # se uma NOVA sessão já começou, não interfere no clipboard dela
            if self.recording or gen != self.session_seq:
                return
            try:
                pyperclip.copy(text)
            except Exception:
                pass
        threading.Thread(target=_copy, daemon=True).start()

    def _finalize(self, frames, duration):
        try:
            print(f'⏳ Transcrevendo {duration:.1f}s de áudio...')
            text = self._transcribe(self._wav_bytes(frames))
            if not text:
                # pode já ter texto injetado ao vivo; nada a corrigir
                self.events.put(('error', 'Transcrição vazia — não ouvi nada.'))
                return

            self._fix_and_complete(text)
            self._leave_transcript_in_clipboard(text)
            self.events.put(('done', text))
            print(f'✅ Digitado: {text[:80]}{"..." if len(text) > 80 else ""}')

            # também vira .md em Documentos/GAMA_VOZ/Transcricoes
            try:
                requests.post(
                    f'{API_BASE}/api/stt/history/save-file',
                    json={'id': f'ditado-{int(time.time()*1000)}',
                          'text': text,
                          'timestamp': int(time.time() * 1000)},
                    timeout=10,
                )
            except Exception:
                pass

        except requests.ConnectionError:
            self.events.put(('error', 'Backend GAMA Voz fora do ar (porta 8000). Inicie com INICIAR_GAMA.bat'))
        except Exception as e:
            self.events.put(('error', f'Erro no ditado: {e}'))

    def _fix_and_complete(self, final_text: str):
        """Fase final (modificadores já soltos): corrige o injetado e completa.

        Compara o que já foi digitado ao vivo com a transcrição final:
        apaga com backspace só o sufixo divergente e digita o restante.
        """
        with self.lock:
            self.injected_text = ''
        time.sleep(0.15)  # garante que os modificadores físicos já subiram
        # mesmo espelho do ao vivo: apaga o divergente em bloco e cola o resto
        self.typer.mirror(final_text)
        self.typer.flush()  # "✓" só depois de terminar de injetar


def main():
    events: queue.Queue = queue.Queue()
    ditado = Ditado(events)
    mods_down: set = set()

    _LLKHF_INJECTED = 0x10
    _WM_KEYDOWN = (0x100, 0x104)
    _WM_KEYUP = (0x101, 0x105)

    listener_ref: list = []

    def win32_event_filter(msg, data):
        # eventos que NÓS injetamos (Ctrl+V, ups de Shift/Alt, backspace):
        # passam ao sistema mas não acionam nossos callbacks
        if data.flags & _LLKHF_INJECTED:
            return False
        # tecla Z física: comanda o ditado e é SUPRIMIDA enquanto grava
        # (evita Ctrl+Z/undo pelo auto-repeat durante o hold)
        if data.vkCode == HOTKEY_VK:
            if msg in _WM_KEYDOWN:
                if ditado.recording:
                    listener_ref[0].suppress_event()  # auto-repeat
                if REQUIRED_MODS.issubset(mods_down):
                    ditado.start()
                    listener_ref[0].suppress_event()
            elif msg in _WM_KEYUP and ditado.recording:
                ditado.stop_and_transcribe()
                listener_ref[0].suppress_event()
        return True

    def on_press(key):
        if key in MOD_KEYS:
            mods_down.add(MOD_KEYS[key])

    def on_release(key):
        if key in MOD_KEYS:
            mods_down.discard(MOD_KEYS[key])
            # soltou um modificador físico no meio da gravação → finaliza
            if ditado.recording:
                ditado.stop_and_transcribe()

    listener = pk.Listener(on_press=on_press, on_release=on_release,
                           win32_event_filter=win32_event_filter)
    listener_ref.append(listener)
    listener.start()
    print('═' * 56)
    print('  GAMA Voz — Ditado Global ativo')
    print('  Segure  Ctrl+Shift+Alt+Z  e fale. O texto é digitado')
    print('  ao vivo onde o cursor estiver; solte para finalizar.')
    print('  ⚠ Não digite nem troque de janela durante o ditado.')
    print('  Ctrl+C nesta janela para encerrar.')
    print('═' * 56)

    root = tk.Tk()
    root.withdraw()
    Overlay(root, events)
    try:
        root.mainloop()
    except KeyboardInterrupt:
        print('\n👋 Ditado encerrado.')


if __name__ == '__main__':
    main()
