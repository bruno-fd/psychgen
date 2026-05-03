import { Link, useLocation } from "wouter";
import { 
  BarChart2, 
  Settings, 
  Database, 
  Activity, 
  FileText, 
  FlaskConical,
  Beaker,
  FolderOpen
} from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: Activity, label: "Painel" },
    { href: "/projects", icon: FolderOpen, label: "Projetos" },
    { href: "/jobs", icon: Settings, label: "Processamento" },
    { href: "/reports", icon: BarChart2, label: "Relatórios" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-r bg-card/50 flex-shrink-0 flex flex-col">
        <div className="p-4 md:p-6 border-b flex items-center gap-3">
          <FlaskConical className="h-6 w-6 text-primary" />
          <h1 className="font-semibold text-lg tracking-tight uppercase">PsychGen BR</h1>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 mt-2 px-2">Workbench</div>
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>Sistema Operacional</span>
          </div>
          v0.1.0-alpha
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
