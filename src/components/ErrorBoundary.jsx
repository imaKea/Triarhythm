import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Triarhythm ErrorBoundary]', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetState = () => {
    try {
      localStorage.removeItem('triarhythm_api_token');
    } catch (_) {}
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 bg-[#0d0d1a] flex flex-col items-center justify-center p-6 text-white select-none">
          <div className="max-w-md w-full p-6 rounded-2xl bg-[#141424] border border-[#ff66ab]/40 shadow-[0_0_40px_rgba(255,102,171,0.2)] flex flex-col items-center text-center animate-fadeIn">
            <div className="w-14 h-14 rounded-full bg-[#ff2a70]/20 border border-[#ff2a70]/50 flex items-center justify-center text-2xl text-[#ff2a70] mb-4">
              ⚠
            </div>
            <h2 className="text-xl font-torus font-black tracking-wide text-white mb-2">
              ĐÃ XẢY RA LỖI GIAO DIỆN
            </h2>
            <p className="text-xs text-[#b8c0d4] mb-4 leading-relaxed font-sans">
              Hệ thống đã tự động bảo vệ dữ liệu beatmap và điểm số của bạn. Bạn có thể thử tải lại trang hoặc khôi phục về trạng thái an toàn.
            </p>

            {this.state.error && (
              <div className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-left mb-5 overflow-auto max-h-36">
                <code className="text-[11px] font-mono text-[#ff80bf] break-all">
                  {String(this.state.error.message || this.state.error)}
                </code>
              </div>
            )}

            <div className="flex items-center gap-3 w-full">
              <button
                onClick={this.handleReload}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-[#ff66ab] to-[#cc5289] text-white font-bold text-xs shadow-[0_0_15px_rgba(255,102,171,0.4)] hover:brightness-110 transition-all cursor-pointer"
              >
                Tải lại trang (F5)
              </button>
              <button
                onClick={this.handleResetState}
                className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-[#8890a4] hover:text-white border border-white/[0.08] text-xs font-semibold transition-all cursor-pointer"
              >
                Khôi phục
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
