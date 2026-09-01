import { Game } from '@/features/game/components';
import { zh } from '@/lib/i18n';

export default function Home() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center">
      {/* Header */}
      <header className="w-full border-b py-4">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-1 px-4">
          <h1 className="text-foreground text-4xl font-bold tracking-tight sm:text-5xl">
            {zh.brand}
          </h1>
          <p className="text-muted-foreground text-lg">{zh.tagline}</p>
        </div>
      </header>

      {/* Main content */}
      <main className="flex w-full flex-1 flex-col items-center px-4 py-8">
        <Game />
      </main>

      {/* Footer */}
      <footer className="border-t py-4">
        <p className="text-muted-foreground text-sm">
          ZuYiBa &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
