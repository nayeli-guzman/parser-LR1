// Pills / etiquetas


// Botón base


// Encabezado de sección
const SectionHeader = ({
  icon: Icon, title, subtitle, right
}: {
  icon: any; title: string; subtitle?: string; right?: React.ReactNode;
}) => (
  <div className="flex items-start justify-between mb-3">
    <div>
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5" />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    {right}
  </div>
);
