// /screens/pending — bulk-imported screens waiting to be claimed on site.
import React from "react";
import PageHeader from "../ui/PageHeader";
import Card from "../ui/Card";
import PendingScreens from "../fleet/enroll/PendingScreens";

export default function PendingScreensPage() {
  return (
    <div>
      <PageHeader
        title="Pending screens"
        subtitle="Imported without a Device ID — claim each one on site to bring it online"
        breadcrumbs={[{ label: "Screens", to: "/screens" }, { label: "Pending" }]}
      />
      <Card padding={0}>
        <PendingScreens />
      </Card>
    </div>
  );
}
