import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** 오류가 났을 때 그 자리에 그릴 화면. reset을 호출하면 다시 시도한다. */
  fallback: (reset: () => void) => ReactNode;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * 한 영역의 렌더 오류를 그 영역에 가둔다. QT 화면이 깨져도 일독 계획 화면은 계속 동작해야 한다.
 * 오류 내용을 서버나 저장소로 보내지 않는다.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // 의도적으로 아무것도 전송·저장하지 않는다.
  }

  private reset = () => this.setState({ failed: false });

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback(this.reset) : this.props.children;
  }
}
