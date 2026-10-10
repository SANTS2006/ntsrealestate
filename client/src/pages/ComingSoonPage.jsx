import { Construction } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Card, CardBody } from '../components/ui/Card.jsx';

export default function ComingSoonPage() {
  const location = useLocation();
  const title = location.pathname
    .split('/')
    .filter(Boolean)
    .pop()
    ?.replace(/-/g, ' ') ?? 'This module';

  return (
    <Card>
      <CardBody className="flex flex-col items-center gap-3 py-16 text-center">
        <Construction size={32} className="text-slate-400" aria-hidden="true" />
        <h1 className="text-lg font-semibold capitalize text-slate-900 dark:text-slate-100">{title}</h1>
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
          This module is being built next. Check back soon.
        </p>
      </CardBody>
    </Card>
  );
}
