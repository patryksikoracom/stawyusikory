// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { initialData } from "@/lib/demo-data";
import type { AppIdentity } from "@/lib/auth/identity";
import { TasksView } from "./tasks-view";
const mocks=vi.hoisted(()=>({report:vi.fn(),update:vi.fn()}));
vi.mock("@/components/layout/app-store",()=>({useAppStore:()=>({data:{...initialData,tasks:[{...initialData.tasks.find(task=>task.type==="Sprzątanie"),id:"TASK",type:"Sprzątanie",status:"Do zrobienia",title:"Sprzątanie",owner:"Test"}]},reportTaskIssue:mocks.report,updateTask:mocks.update})}));
const identity:AppIdentity={authenticated:true,displayName:"Test",email:null,initials:"T",organizationId:"test",organizationName:"Test",role:"owner",roleLabel:"Właściciel",userId:"test",availableOrganizations:[]};
afterEach(()=>{cleanup();vi.clearAllMocks();});
it("pozostawia zgłoszenie usterki przy odrzuceniu atomowego zapisu",async()=>{
  mocks.report.mockResolvedValue({ok:false,message:"Konflikt zadania"});
  render(<TasksView identity={identity}/>);
  fireEvent.click(screen.getByRole("button",{name:"Zgłoś usterkę"}));
  const dialog=screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Krótki tytuł"),{target:{value:"Cieknie kran"}});
  fireEvent.click(within(dialog).getByRole("button",{name:"Zapisz usterkę"}));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("Konflikt zadania");
  expect(within(dialog).getByLabelText("Krótki tytuł")).toHaveValue("Cieknie kran");
  expect(mocks.update).not.toHaveBeenCalled();
});
it("nie potwierdza awaryjnej gotowości po błędzie zapisu",async()=>{
  mocks.update.mockResolvedValue(false);
  render(<TasksView identity={identity}/>);
  fireEvent.click(screen.getByRole("button",{name:"Nadpisz gotowość"}));
  const dialog=screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Powód nadpisania"),{target:{value:"Osobista kontrola"}});
  fireEvent.click(within(dialog).getByRole("button",{name:"Zapisz nadpisanie"}));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("Nie potwierdzono zapisu");
  expect(within(dialog).getByLabelText("Powód nadpisania")).toHaveValue("Osobista kontrola");
});

it("pokazuje błąd zwykłej akcji zadania i blokuje ponowne kliknięcie w trakcie",async()=>{
  let resolve!: (value:boolean)=>void;
  mocks.update.mockImplementation(()=>new Promise(done=>{resolve=done;}));
  render(<TasksView identity={identity}/>);
  const start=screen.getByRole("button",{name:"Rozpocznij"});
  fireEvent.click(start);
  expect(start).toBeDisabled();
  fireEvent.click(start);
  expect(mocks.update).toHaveBeenCalledOnce();
  resolve(false);
  expect(await screen.findByRole("alert")).toHaveTextContent("Nie potwierdzono zapisu");
  expect(start).toBeEnabled();
});
