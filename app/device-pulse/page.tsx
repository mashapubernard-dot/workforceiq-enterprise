"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/supabase/client"

export default function DevicePulse() {
  const [devices, setDevices] = useState<any[]>([])

  useEffect(() => {
    supabase.from("devices").select("*").then(({data})=> setDevices(data||[]))
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Device Pulse - LemonTreeCorp</h1>
      <div className="grid gap-3">
        {devices.map(d=> (
          <div key={d.id} className="border p-3 rounded flex justify-between">
            <div>
              <b>Store {d.store_number}</b> - {d.device_name} ({d.device_type})<br/>
              <span className="text-sm">{d.ip_address} | Router: {d.router_ip}</span>
            </div>
            <div className="flex gap-2">
              <span className={`px-2 py-1 rounded text-xs ${d.status==='online'?'bg-green-100':'bg-red-100'}`}>{d.status}</span>
              <a href={`http://${d.router_ip}`} target="_blank" className="bg-blue-600 text-white px-3 py-1 rounded text-sm">Remote</a>
            </div>
          </div>
        ))}
      </div>
      {devices.length===0 && <p>No devices yet - add in ppinger or here.</p>}
    </div>
  )
}
