interface LoadingSpinnerProps {
  message?: string;
}

export default function LoadingSpinner({ message }: LoadingSpinnerProps) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-violet"></div>
        <p className="mt-4 text-ink-700">
          {message ?? "Loading..."}
        </p>
      </div>
    </div>
  );
}
