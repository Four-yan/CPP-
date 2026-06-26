import React, { type ReactNode } from 'react';

interface Props {
  fallback?: React.ReactNode;
  children: ReactNode;
}

export default class ErrorBoundary extends React.Component<Props, { hasError: boolean; error: Error | null }> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-gray-50">
            <div className="text-4xl mb-4">😵</div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">哎呀，出了点问题</h2>
            <p className="text-sm text-gray-500 mb-4">{this.state.error?.message || '未知错误'}</p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-6 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 transition-colors"
            >
              刷新页面
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
