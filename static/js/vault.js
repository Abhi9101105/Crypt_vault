function showToast(message, type) {
  const container = document.getElementById("toast-container");
  if (!container) {
    return;
  }

  const toast = document.createElement("div");
  toast.className = `vault-toast ${type === "error" ? "error" : ""}`;
  toast.textContent = message;
  container.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 4200);
}

function setupDropZone() {
  const dropZone = document.querySelector("[data-drop-zone]");
  const fileInput = document.getElementById("file");
  const fileName = document.querySelector("[data-file-name]");

  if (!dropZone || !fileInput || !fileName) {
    return;
  }

  const updateFileName = () => {
    if (fileInput.files.length > 0) {
      fileName.textContent = fileInput.files[0].name;
    }
  };

  fileInput.addEventListener("change", updateFileName);

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("drag-over");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("drag-over");
    });
  });

  dropZone.addEventListener("drop", (event) => {
    if (event.dataTransfer.files.length > 0) {
      fileInput.files = event.dataTransfer.files;
      updateFileName();
    }
  });
}

function setupIntegrityVerification() {
  const csrfToken = document.querySelector("meta[name='csrf-token']")?.content || "";
  const buttons = document.querySelectorAll(".js-verify-file");

  buttons.forEach((button) => {
    button.addEventListener("click", async () => {
      const resultTarget = document.getElementById(button.dataset.resultTarget);
      button.disabled = true;

      try {
        const response = await fetch(button.dataset.verifyUrl, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "X-CSRFToken": csrfToken,
          },
          credentials: "same-origin",
        });

        if (!response.ok) {
          throw new Error("Verification request failed.");
        }

        const data = await response.json();
        const intact = data.status === "intact";

        if (resultTarget) {
          resultTarget.textContent = intact ? "Intact" : "Corrupted";
          resultTarget.className = `integrity-badge ${intact ? "intact" : "corrupted"}`;
        }

        showToast(
          intact ? "File integrity verified: intact." : "File integrity check failed: corrupted.",
          intact ? "success" : "error"
        );
      } catch (error) {
        if (resultTarget) {
          resultTarget.textContent = "Error";
          resultTarget.className = "integrity-badge corrupted";
        }
        showToast("Could not verify file integrity.", "error");
      } finally {
        button.disabled = false;
      }
    });
  });
}

function setupAuditFilter() {
  const filterInput = document.querySelector("[data-audit-filter]");
  const rows = document.querySelectorAll("[data-audit-row]");
  const emptyState = document.querySelector("[data-empty-filter]");

  if (!filterInput || rows.length === 0) {
    return;
  }

  filterInput.addEventListener("input", () => {
    const query = filterInput.value.trim().toLowerCase();
    let visibleCount = 0;

    rows.forEach((row) => {
      const isVisible = row.dataset.search.includes(query);
      row.hidden = !isVisible;
      if (isVisible) {
        visibleCount += 1;
      }
    });

    if (emptyState) {
      emptyState.hidden = visibleCount !== 0;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupDropZone();
  setupIntegrityVerification();
  setupAuditFilter();
});
