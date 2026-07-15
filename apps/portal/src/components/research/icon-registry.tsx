import {
  Brain, Database, FileText, Search, Zap, BarChart3,
  GitBranch, Layers, Target, TrendingUp, type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  brain: Brain,
  database: Database,
  file: FileText,
  search: Search,
  zap: Zap,
  chart: BarChart3,
  git: GitBranch,
  layers: Layers,
  target: Target,
  trending: TrendingUp,
};

export function getIcon(name: string): LucideIcon {
  return iconMap[name] ?? Layers;
}
