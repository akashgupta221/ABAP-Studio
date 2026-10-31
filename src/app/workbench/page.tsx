import type { Metadata } from 'next'
import { SapShell } from '@/components/workbench/sap-shell'

export const metadata: Metadata = {
  title: 'SAP Easy Access — ABAP Atelier',
  description:
    'The ABAP Atelier workbench: SAP Easy Access, SE38 ABAP Editor, SE37 Function Builder, SE11 Dictionary, SE16N Data Browser, debugger and ST22 dump analysis.',
}

export default function WorkbenchPage() {
  return <SapShell />
}
