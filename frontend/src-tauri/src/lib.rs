use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

// Apply Windows-only window styling:
//   • WS_EX_NOACTIVATE  — clicking the pill never steals focus from the
//                         user's text field (this is what fixes the
//                         "cursor jumps away from notepad" problem)
//   • WS_EX_TOOLWINDOW  — keep the pill out of Alt-Tab
//   • DWM border color  — remove the thin Windows 11 accent outline
//   • DWM corner pref   — let our CSS handle rounding
#[cfg(target_os = "windows")]
fn apply_windows_style(win: &tauri::WebviewWindow) {
    use windows_sys::Win32::Graphics::Dwm::DwmSetWindowAttribute;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
    };

    const DWMWA_BORDER_COLOR: u32 = 34;
    const DWMWA_WINDOW_CORNER_PREFERENCE: u32 = 33;
    const DWMWCP_DONOTROUND: u32 = 1;
    const DWMWA_COLOR_NONE: u32 = 0xFFFFFFFE;

    let Ok(hwnd) = win.hwnd() else { return };
    let hwnd = hwnd.0 as _;

    unsafe {
        let cur = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        SetWindowLongPtrW(
            hwnd,
            GWL_EXSTYLE,
            cur | (WS_EX_NOACTIVATE as isize) | (WS_EX_TOOLWINDOW as isize),
        );

        let color: u32 = DWMWA_COLOR_NONE;
        DwmSetWindowAttribute(
            hwnd,
            DWMWA_BORDER_COLOR,
            &color as *const _ as _,
            std::mem::size_of::<u32>() as u32,
        );

        let pref: u32 = DWMWCP_DONOTROUND;
        DwmSetWindowAttribute(
            hwnd,
            DWMWA_WINDOW_CORNER_PREFERENCE,
            &pref as *const _ as _,
            std::mem::size_of::<u32>() as u32,
        );
    }
}

// Called from JS after clipboard is populated. Waits briefly, then
// simulates Ctrl+V into whatever window currently has focus.
#[tauri::command]
async fn paste_text() -> Result<(), String> {
    tokio::time::sleep(tokio::time::Duration::from_millis(120)).await;
    tokio::task::spawn_blocking(|| {
        let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
        enigo.key(Key::Control, Direction::Press).map_err(|e| e.to_string())?;
        enigo.key(Key::Unicode('v'), Direction::Click).map_err(|e| e.to_string())?;
        enigo.key(Key::Control, Direction::Release).map_err(|e| e.to_string())?;
        Ok::<(), String>(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            #[cfg(target_os = "windows")]
            if let Some(win) = app.get_webview_window("main") {
                apply_windows_style(&win);
            }

            app.global_shortcut()
                .on_shortcut("CommandOrControl+Space", |app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.emit("hotkey-pressed", ());
                        }
                    }
                })?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![paste_text])
        .run(tauri::generate_context!())
        .expect("error running FreeWhisper");
}
