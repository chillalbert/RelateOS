import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorDetails = null;
      try {
        if (this.state.error?.message) {
          errorDetails = JSON.parse(this.state.error.message);
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-[32px] p-8 shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={32} />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight">Something went wrong</h2>
              <p className="text-sm text-zinc-500">
                {errorDetails ? 'A security or permission error occurred while accessing data.' : 'An unexpected error occurred.'}
              </p>
            </div>

            {errorDetails && (
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl text-left space-y-2 overflow-auto max-h-48">
                <p className="text-[10px] font-bold uppercase text-zinc-400">Error Context</p>
                <pre className="text-[10px] font-mono whitespace-pre-wrap break-all">
                  {JSON.stringify(errorDetails, null, 2)}
                </pre>
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
            >
              <RefreshCw size={18} />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
