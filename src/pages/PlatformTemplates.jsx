// Screen templates — mounts the existing designer suite (TemplatesTab) at a
// real URL. The designer components still use the legacy theme via the App
// compat export; they get rebuilt in a later pass.
import PageHeader from "../ui/PageHeader";
import TemplatesTab from "../components/templates/TemplatesTab";

export default function PlatformTemplates() {
  return (
    <div>
      <PageHeader title="Screen templates" subtitle="Design layouts and link them to companies" />
      <div className="legacy-page" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16 }}>
        <TemplatesTab />
      </div>
    </div>
  );
}
