import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function SettingsPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">Настройки</h1>
      <Card>
        <div className="mb-4">
          <label className="flex items-center">
            <input type="checkbox" className="mr-2" defaultChecked />
            <span>Включить звук</span>
          </label>
        </div>
        <div className="mb-4">
          <label className="flex items-center">
            <input type="checkbox" className="mr-2" defaultChecked />
            <span>Включить голос</span>
          </label>
        </div>
        <div className="mb-4">
          <label className="flex items-center">
            <input type="checkbox" className="mr-2" defaultChecked />
            <span>Включить push-уведомления</span>
          </label>
        </div>
        <Button variant="secondary">Вернуться</Button>
      </Card>
    </div>
  )
}
