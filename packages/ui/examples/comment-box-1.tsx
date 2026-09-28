import * as React from "react";
import { CommentBox } from "@/components/crm/comment-box";

export default function Example() {
  const [comments, setComments] = React.useState<string[]>([]);
  return (
    <div className="flex w-[460px] flex-col gap-3">
      <CommentBox
        author={{ name: "Maya Chen" }}
        mentionables={[
          { id: "1", name: "Leo Park" },
          { id: "2", name: "Sam Ortiz" },
          { id: "3", name: "Rachel Green" },
        ]}
        onAttach={() => {}}
        onSubmit={(text) => setComments((c) => [...c, text])}
      />
      {comments.map((c, i) => (
        <p key={i} className="rounded-crm bg-crm-card px-3 py-2 text-sm text-crm-fg">
          {c}
        </p>
      ))}
    </div>
  );
}
