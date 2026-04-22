import { PageHeader } from '@/components/layout/PageHeader'

export function Loggbok() {
  return (
    <div>
      <PageHeader
        kicker="Loggbok"
        title="Service och händelser"
        description="Bygger på den fysiska serviceloggboken som följer enheten — kvartalsbesök, OS-uppdateringar, innehållsbyten, incidentanteckningar."
      />

      <div className="surface p-12 text-center">
        <p className="font-serif text-lg text-ink-soft">Loggboksvyn implementeras i nästa iteration.</p>
        <p className="mt-2 font-mono text-xs text-ink-muted">
          Dataförslag: kommuner/&lt;kommun&gt;/loggbok.jsonl med en rad per händelse.
        </p>
      </div>
    </div>
  )
}
