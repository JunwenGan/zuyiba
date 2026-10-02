import type { ComparisonResult } from '../game/types';
import type { OpponentField, OpponentGuess } from './opponent-guess';

const fields: { key: OpponentField; label: string }[] = [
  { key: 'nationality', label: '国籍' },
  { key: 'club', label: '俱乐部' },
  { key: 'league', label: '联赛' },
  { key: 'position', label: '位置' },
  { key: 'age', label: '年龄' },
];
const styles: Record<ComparisonResult, { label: string; icon: string; className: string }> = {
  correct: {
    label: '正确',
    icon: '✓',
    className: 'bg-green-500/20 text-green-700 dark:text-green-400',
  },
  partial: {
    label: '相近',
    icon: '−',
    className: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  },
  incorrect: {
    label: '错误',
    icon: '×',
    className: 'bg-red-500/20 text-red-700 dark:text-red-400',
  },
};

export function OpponentGuessTable({ guesses }: { guesses: OpponentGuess[] }) {
  return (
    <section
      aria-labelledby="opponent-guesses-heading"
      className="min-w-0 space-y-3 rounded-xl border p-4"
    >
      <h2 id="opponent-guesses-heading" className="font-semibold">
        朋友的猜测
      </h2>
      <p className="text-muted-foreground text-sm">
        仅显示颜色：绿 ✓ 正确 · 黄 − 相近 · 红 × 错误。球员和具体数值保密。
      </p>
      <p role="status" className="text-muted-foreground text-sm">
        朋友已猜 {guesses.length} 次
      </p>
      {guesses.length === 0 ? (
        <p className="text-muted-foreground text-sm">朋友还没有猜测</p>
      ) : (
        <table
          aria-label="朋友的猜测颜色"
          className="w-full table-fixed border-collapse text-center text-xs sm:text-sm"
        >
          <thead>
            <tr className="text-muted-foreground border-b">
              <th scope="col" className="w-8 py-2 font-medium">
                #
              </th>
              {fields.map((field) => (
                <th scope="col" key={field.key} className="py-2 font-medium">
                  {field.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {guesses.map((guess) => (
              <tr key={guess.guessNumber} className="border-b last:border-0">
                <th scope="row" className="py-2 font-medium">
                  {guess.guessNumber}
                </th>
                {fields.map((field) => {
                  const style = styles[guess.results[field.key]];
                  return (
                    <td key={field.key} className="px-1 py-2">
                      <span
                        aria-label={`${field.label}：${style.label}`}
                        className={`mx-auto flex size-8 items-center justify-center rounded-md font-semibold sm:size-10 ${style.className}`}
                      >
                        <span aria-hidden="true">{style.icon}</span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
