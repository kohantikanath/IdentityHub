const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

interface AlphabetFilterProps {
  selected: string
  onSelect: (letter: string) => void
}

export default function AlphabetFilter({ selected, onSelect }: AlphabetFilterProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {LETTERS.map((letter) => (
        <button
          key={letter}
          onClick={() => onSelect(selected === letter ? '' : letter)}
          title={`Filter names starting with ${letter}`}
          className={`w-7 h-7 text-xs font-medium rounded-md transition-colors ${
            selected === letter ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
          }`}
        >
          {letter}
        </button>
      ))}
    </div>
  )
}
