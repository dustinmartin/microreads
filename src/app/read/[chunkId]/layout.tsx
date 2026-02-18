export default function ReadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen" style={{ overscrollBehaviorY: 'contain' }}>{children}</div>;
}
