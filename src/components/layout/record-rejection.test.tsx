// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllEnvs();vi.unstubAllGlobals();});
it.each([403,422])("cofa zadanie i checklistę po jednoznacznym odrzuceniu %i",async(status)=>{
  vi.useFakeTimers();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY","test");
  Object.defineProperty(window,"localStorage",{configurable:true,value:{length:0,getItem:()=>null,setItem:vi.fn(),removeItem:vi.fn(),key:()=>null}});
  const task={id:"task",title:"Sprzątanie",type:"Sprzątanie",status:"W toku",priority:"Średni",owner:"Test",version:1};
  const item={id:"item",taskId:"task",label:"Sprawdź domek",done:false,version:1};
  const fetch=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({data:{tasks:[task],checklistItems:[item]},version:1})}).mockResolvedValue({ok:false,status,json:async()=>({error:"Odrzucono"})});
  vi.stubGlobal("fetch",fetch);
  const {AppStoreProvider,useAppStore}=await import("./app-store");
  let store!:ReturnType<typeof useAppStore>;
  function Probe(){store=useAppStore();return null;}
  const rendered=render(<AppStoreProvider><Probe/></AppStoreProvider>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  await act(async()=>{expect(await store.updateTask({...store.data.tasks[0],status:"Zrobione"})).toBe(false);});
  expect(store.data.tasks[0].status).toBe("W toku");
  expect(store.data.tasks[0].version).toBe(1);
  rendered.unmount();
  fetch.mockResolvedValueOnce({ok:true,json:async()=>({data:{tasks:[task],checklistItems:[item]},version:1})});
  render(<AppStoreProvider><Probe/></AppStoreProvider>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  await act(async()=>{expect(await store.toggleChecklistItem({...store.data.checklistItems[0],done:true})).toBe(false);});
  expect(store.data.checklistItems[0].done).toBe(false);
  expect(store.data.checklistItems[0].version).toBe(1);
});
