interface DataCardProps {
  title: string;
  value: string | number;
}

export function DataCard({ title, value }: DataCardProps) {
  return (
    <div className="flex flex-col border border-border w-full">
      <div className="px-6 pt-6 pb-4 w-full">
        <div className="text-h4 text-primary">{value}</div>
      </div>
      <div className="px-6 pb-6 w-full">
        <div className="text-h6 text-secondary">{title}</div>
      </div>
    </div>
  );
}
