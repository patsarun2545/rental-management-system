import Swal from "sweetalert2";

const baseConfig = {
  confirmButtonColor: "#0d6efd",
  cancelButtonColor: "#6c757d",
};

export const showSuccess = (message = "Success", timer = 1200) => {
  return Swal.fire({
    ...baseConfig,
    icon: "success",
    title: message,
    timer,
    showConfirmButton: false,
  });
};

export const showError = (error, title = "Error") => {
  const message =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    error ||
    "Something went wrong";

  return Swal.fire({
    ...baseConfig,
    icon: "error",
    title,
    text: message,
  });
};

export const showWarning = (message = "Warning") => {
  return Swal.fire({
    ...baseConfig,
    icon: "warning",
    title: message,
  });
};

export const showInfo = (message = "Information") => {
  return Swal.fire({
    ...baseConfig,
    icon: "info",
    title: message,
  });
};

export const showConfirm = async (
  title = "Are you sure?",
  text = "",
  confirmText = "Confirm",
  cancelText = "Cancel",
) => {
  const result = await Swal.fire({
    ...baseConfig,
    icon: "question",
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
  });

  return result.isConfirmed;
};

export const showLoading = (title = "Loading...") => {
  return Swal.fire({
    title,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });
};

export const closeAlert = () => {
  Swal.close();
};

const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 1500,
  timerProgressBar: true,
});

export const showToastSuccess = (message = "Success") => {
  return Toast.fire({
    icon: "success",
    title: message,
  });
};

export const showToastError = (message = "Error") => {
  return Toast.fire({
    icon: "error",
    title: message,
  });
};

export const showPromptNumber = async (
  title = "กรอกตัวเลข",
  defaultValue = ""
) => {
  const { value } = await Swal.fire({
    ...baseConfig,
    title,
    input: "number",
    inputValue: defaultValue,
    showCancelButton: true,
  });

  return value;
};
