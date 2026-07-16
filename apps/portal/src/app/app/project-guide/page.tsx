import dynamic from "next/dynamic";

const ProjectGuide = dynamic(() => import("./project-guide-client").then((m) => m.ProjectGuide), {
  loading: () => <div className="animate-pulse bg-surface rounded-lg h-96" />,
});

export const metadata = {
  title: "Project Guide",
};

export default async function ProjectGuidePage() {
  return <ProjectGuide />;
}
