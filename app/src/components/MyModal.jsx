import React from "react";

export default function Modal({ title, open, onClose, onSave, children }) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="modal-backdrop fade show" onClick={onClose}></div>

      {/* Modal */}
      <div
        className="modal fade show d-block"
        tabIndex={-1}
        style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
              ></button>
            </div>

            <div className="modal-body">{children}</div>

            {(onSave || onClose) && (
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={onClose}>
                  ยกเลิก
                </button>

                {onSave && (
                  <button className="btn btn-primary" onClick={onSave}>
                    บันทึก
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
