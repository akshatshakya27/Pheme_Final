import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}> = ({ title, subtitle, breadcrumbs, actions }) => {
  return (
    <div className="mb-6 space-y-2">
      {breadcrumbs && (
        <nav className="flex items-center gap-1 text-xs text-muted-foreground">
          {breadcrumbs.map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              {item.path ? (
                <Link to={item.path} className="hover:text-foreground transition-colors">{item.label}</Link>
              ) : (
                <span className="text-foreground font-medium">{item.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
};

export default PageHeader;
