export {
  createSubject,
  updateSubjectDetails,
  toggleSubjectActive,
  deleteSubject,
  addSubjectTeacher,
  removeSubjectTeacher,
} from "./actions";
export { AddSubjectDialog } from "./ui/add-subject-dialog";
export { DEFAULT_SUBJECT_NAME } from "./service/subjects";
export { isSubjectAssignableToCourse } from "./service/subject-access";
