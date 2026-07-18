// Screen template content (location scope). When the company has a linked
// screen template, this card opens the LEGACY ZoneContentEditor with the exact
// props the old Shop page used (scope="shop", targetId=numeric shop id,
// targetName=shop_name) — the editor itself is NOT rebuilt in this wave.
// No template linked is a legitimate empty state, never an error.
import { useState } from "react";
import { Layers } from "lucide-react";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import EmptyState from "../../ui/EmptyState";
import ErrorState from "../../ui/ErrorState";
import Skeleton from "../../ui/Skeleton";
import ZoneContentEditor from "../../components/templates/ZoneContentEditor";
import { useAuth, CONTENT_EDIT_PERMS } from "../../lib/auth";

export default function TemplateContentCard({ shop, template }) {
  const { hasPermission } = useAuth();
  const canEditContent = CONTENT_EDIT_PERMS.some((perm) => hasPermission(perm));
  // template: {loading, error, template|null, reload} from useCompanyTemplate.
  const [editorOpen, setEditorOpen] = useState(false);

  return (
    <Card title="Screen template content">
      {template.loading ? (
        <Skeleton height={14} width="60%" />
      ) : template.error ? (
        <ErrorState message={template.error} onRetry={template.reload} />
      ) : !template.template ? (
        <EmptyState
          icon={Layers}
          title="No screen template linked to your company"
          hint="A platform admin can link one; its QR, image and text zones are then filled in per location here."
        />
      ) : (
        <>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px" }}>
            This company uses the screen template "{template.template.name || "Untitled"}". The QR
            code, images and texts you fill in here show on every screen at this location. To
            change a single screen, use "Override for this screen" in the Screens list above —
            overrides win over the location's content.
          </p>
          {canEditContent && (
            <Button
              variant="secondary"
              icon={Layers}
              onClick={() => setEditorOpen(true)}
              title="Fill in the QR code, images and texts shown on this location's screens"
            >
              Edit screen content
            </Button>
          )}
          {editorOpen && (
            <div className="legacy-page">
              <ZoneContentEditor
                scope="shop"
                targetId={shop.id}
                targetName={shop.shop_name}
                onClose={() => setEditorOpen(false)}
              />
            </div>
          )}
        </>
      )}
    </Card>
  );
}
