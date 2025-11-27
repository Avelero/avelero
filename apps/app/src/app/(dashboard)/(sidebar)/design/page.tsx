export default function ContentPage() {
  return (
    <div className="flex w-full h-full">
      {/* Left Panel - Content */}
      <div className="flex w-[300px] h-full border-r border-border">
      </div>

      {/* Middle Panel - Preview */}
      <div className="flex w-full h-full bg-accent p-6">
        <div className="flex w-full h-full bg-white border border-border items-center justify-center">
          <h5 className="type-h5 text-primary">Preview</h5>
        </div>
      </div>

      {/* Right Panel - Theme */}
      <div className="flex w-[300px] h-full border-r border-border">
      </div>
    </div>
  );
}
