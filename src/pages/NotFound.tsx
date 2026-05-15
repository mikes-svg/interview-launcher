export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-card rounded-2xl shadow-lg p-8 max-w-md text-center">
        <p className="text-6xl mb-4">🤔</p>
        <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
        <p className="text-muted-foreground">
          The interview link you opened may be incomplete. Please use the link
          from your email exactly as it was sent.
        </p>
      </div>
    </div>
  );
}
