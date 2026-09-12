import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Keeps a failure inside the audio engine from blanking the page. Decoding
 * eight stems through the Web Audio API is the most fragile part of the app,
 * and a bare white screen gives the visitor nothing to act on.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="grid min-h-screen place-items-center bg-[#00060f] px-6 text-center">
        <div className="max-w-[420px]">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#a5bed3]">
            Playback unavailable
          </p>
          <h1 className="mt-4 text-[26px] font-light leading-tight text-white">
            Something interrupted the audio engine.
          </h1>
          <p className="mt-4 text-[14px] leading-6 text-white/60">
            Reload the page to start again. If it keeps happening, check that your
            browser allows the Web Audio API.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-8 bg-gradient-to-r from-[#6a99ab] to-[#a5bed3] px-5 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[#00060f] transition-opacity hover:opacity-90">
            Reload
          </button>
        </div>
      </div>
    );
  }
}
