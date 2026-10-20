import { classify, ErrorScreen } from './ErrorScreen'

/** Inline error for any failed load: same ghost as the full error pages, face picked from the message. */
export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return <ErrorScreen compact kind={classify(message)} message={message} onRetry={onRetry} className={className} />
}
