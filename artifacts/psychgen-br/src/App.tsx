import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import ProjectNew from "@/pages/ProjectNew";
import ProjectDetail from "@/pages/ProjectDetail";
import RunAigenie from "@/pages/RunAigenie";
import RunDifficulty from "@/pages/RunDifficulty";
import RunIrt from "@/pages/RunIrt";
import ItemDetail from "@/pages/ItemDetail";
import Jobs from "@/pages/Jobs";
import JobDetail from "@/pages/JobDetail";
import Reports from "@/pages/Reports";
import ReportDetail from "@/pages/ReportDetail";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/projects" component={Projects} />
        <Route path="/projects/new" component={ProjectNew} />
        <Route path="/projects/:id" component={ProjectDetail} />
        <Route path="/projects/:id/run/aigenie" component={RunAigenie} />
        <Route path="/projects/:id/run/difficulty" component={RunDifficulty} />
        <Route path="/projects/:id/run/irt" component={RunIrt} />
        <Route path="/projects/:id/items/:itemId" component={ItemDetail} />
        <Route path="/jobs" component={Jobs} />
        <Route path="/jobs/:id" component={JobDetail} />
        <Route path="/reports" component={Reports} />
        <Route path="/reports/:id" component={ReportDetail} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
