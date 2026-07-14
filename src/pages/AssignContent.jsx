// Assign content: pick a group (or Ungrouped), edit its playlist — the same
// PlaylistEditor the group detail page uses, one implementation.
import { useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../ui/PageHeader";
import Card from "../ui/Card";
import ErrorState from "../ui/ErrorState";
import { Field, Select } from "../ui/Field";
import PlaylistEditor from "../content/groups/PlaylistEditor";
import { useGroups, NO_GROUP_VALUE, NO_GROUP_LABEL } from "../content/groups/useGroupAttachments";

export default function AssignContent() {
  const { groups, loading, error, reload } = useGroups();
  const [gname, setGname] = useState("");

  return (
    <div>
      <PageHeader
        title="Assign content"
        subtitle="Choose a group, then set what its screens play"
      />
      <Card>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <Field
            label={`Group (${groups.length} available)`}
            hint={
              groups.length === 0 && !loading ? (
                <>No groups yet — <Link to="/groups">create one first</Link>.</>
              ) : (
                <>Manage a group's screens on its <Link to={gname && gname !== NO_GROUP_VALUE ? `/groups/${encodeURIComponent(gname)}` : "/groups"}>detail page</Link>.</>
              )
            }
            htmlFor="assign-group"
          >
            <Select
              id="assign-group"
              value={gname}
              onChange={(e) => setGname(e.target.value)}
              placeholder={loading ? "Loading groups…" : "Select a group…"}
              options={[
                { value: NO_GROUP_VALUE, label: `— ${NO_GROUP_LABEL} —` },
                ...groups.map((g) => ({ value: g.gname, label: g.gname })),
              ]}
            />
          </Field>
        )}
      </Card>
      {gname && (
        <div style={{ marginTop: 16 }}>
          <PlaylistEditor key={gname} gname={gname} />
        </div>
      )}
    </div>
  );
}
