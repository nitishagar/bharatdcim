import { Link } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  to?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-3 dark:text-gray-400">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && (
            <svg className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {item.to ? (
            <Link to={item.to} className="text-navy hover:underline dark:text-blue-400">
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-700 font-medium dark:text-gray-200">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
