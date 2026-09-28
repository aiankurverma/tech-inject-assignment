import { EduCourses, type CourseSection } from "@/components/crm/edu-courses";

const sections: CourseSection[] = [
  {
    id: "cs201-01",
    code: "CS 201",
    title: "Data Structures",
    credits: 4,
    instructor: "Dr. Okoye",
    days: ["Mon", "Wed"],
    start: "09:00",
    end: "10:50",
    room: "ENG 120",
    capacity: 60,
    enrolled: 58,
    prerequisites: ["CS 101"],
  },
  {
    id: "cs220-01",
    code: "CS 220",
    title: "Computer Architecture",
    credits: 3,
    instructor: "Dr. Lindqvist",
    days: ["Tue", "Thu"],
    start: "10:00",
    end: "11:15",
    room: "ENG 204",
    capacity: 45,
    enrolled: 45,
    waitlist: 7,
    prerequisites: ["CS 201"],
  },
  {
    id: "ma221-02",
    code: "MATH 221",
    title: "Linear Algebra",
    credits: 3,
    instructor: "Prof. Haddad",
    days: ["Mon", "Wed", "Fri"],
    start: "10:00",
    end: "10:50",
    room: "SCI 310",
    capacity: 80,
    enrolled: 61,
    prerequisites: ["MATH 120"],
  },
  {
    id: "ec101-03",
    code: "ECON 101",
    title: "Principles of Microeconomics",
    credits: 3,
    instructor: "Dr. Brennan",
    days: ["Tue", "Thu"],
    start: "13:00",
    end: "14:15",
    room: "HUM 105",
    capacity: 120,
    enrolled: 97,
  },
  {
    id: "wr150-05",
    code: "WRIT 150",
    title: "Academic Writing",
    credits: 3,
    instructor: "Ms. Park",
    days: ["Fri"],
    start: "13:00",
    end: "15:50",
    room: "HUM 218",
    capacity: 22,
    enrolled: 19,
  },
  {
    id: "ph210-01",
    code: "PHYS 210",
    title: "Mechanics with Lab",
    credits: 4,
    instructor: "Dr. Varga",
    days: ["Mon", "Wed"],
    start: "14:00",
    end: "15:50",
    room: "SCI 101",
    capacity: 48,
    enrolled: 30,
    prerequisites: ["MATH 120"],
  },
  {
    id: "st200-01",
    code: "STAT 200",
    title: "Intro to Statistics",
    credits: 3,
    instructor: "Dr. Moreau",
    days: ["Mon", "Wed"],
    start: "10:30",
    end: "11:45",
    room: "SCI 222",
    capacity: 70,
    enrolled: 44,
  },
];

export default function Example() {
  return (
    <EduCourses
      className="w-[1100px]"
      sections={sections}
      completed={["CS 101", "MATH 120"]}
      defaultCart={["cs201-01", "ma221-02", "st200-01"]}
      onRegister={(s) =>
        console.log(
          "register",
          s.map((x) => x.code),
        )
      }
    />
  );
}
