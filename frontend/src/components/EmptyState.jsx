import React from "react";
import { Files, Upload } from "lucide-react";

export default function EmptyState({ type = "files" }) {
  const content = {
    files: {
      icon: <Files size={48} className="text-text-muted" />,
      title: "No files yet",
      description: "Upload your first file to get started. All files are encrypted with AES-256-GCM.",
    },
    shared: {
      icon: <Files size={48} className="text-text-muted" />,
      title: "No shared files",
      description: "Files shared with you by other users will appear here.",
    },
  };

  const c = content[type] || content.files;

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-2xl bg-bg-elevated flex items-center justify-center mb-5">
        {c.icon}
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-2">{c.title}</h3>
      <p className="text-sm text-text-secondary max-w-sm">{c.description}</p>
    </div>
  );
}
