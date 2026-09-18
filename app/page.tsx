import { Button } from "@/components/ui/button"
import GhostFibers from "@/components/GhostFibers"

export default function Page() {
  return (
    <div className="relative flex min-h-svh overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0">
        <GhostFibers />
      </div>
      <div className="relative z-10 flex max-w-md min-w-0 flex-col gap-4 rounded-xl bg-background/85 p-6 text-sm leading-loose shadow-lg backdrop-blur-sm">
        <div>
          <h1 className="font-medium">Project ready!</h1>
          <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Ullam eveniet debitis, aut quasi porro eaque atque quas officiis nemo culpa tenetur voluptas, omnis nihil nisi? Ipsa unde vel, quod eos incidunt dolorem corporis quibusdam itaque molestiae dicta architecto vitae libero distinctio magnam velit nostrum eius! Ab eos minima assumenda veritatis quia, quidem cumque id quod vero omnis iste molestiae animi doloremque enim, et impedit accusamus accusantium. Recusandae molestias natus corporis aspernatur? Ducimus laborum sint suscipit, consequuntur iure nobis recusandae laboriosam perspiciatis animi, dolores ullam odit est possimus reprehenderit eaque non maxime beatae totam mollitia maiores corrupti illum. Voluptas quis nostrum quos blanditiis quo ut eligendi dolore officiis nisi dignissimos voluptates, suscipit reprehenderit libero explicabo amet id totam alias. Velit veniam quisquam voluptatem rem porro eum id consequatur molestiae. Repellendus, corrupti blanditiis veniam dolores labore totam veritatis incidunt sequi alias facilis temporibus voluptas optio quam necessitatibus. Earum ut doloribus repellat eius cupiditate assumenda sed quod eum expedita fugit, sapiente suscipit dolor! Iure, suscipit. Quae non quaerat optio quod nihil maiores officiis, dolorum vero aperiam dignissimos maxime, saepe asperiores, facere cumque voluptates. Nostrum aspernatur nisi magni soluta nesciunt laudantium voluptates fuga ipsum maxime. Dignissimos totam, aperiam perspiciatis molestiae placeat ipsa beatae eos amet quibusdam tempora perferendis dolore velit, consequatur ipsam suscipit praesentium commodi ut voluptas natus necessitatibus optio voluptatibus? Iste iusto, quod excepturi quibusdam ex rerum. Magnam aliquam illo eum eos necessitatibus molestias, corrupti eius pariatur cum excepturi tempore possimus ducimus, optio officia quae non dolores ratione obcaecati quos a repellat enim officiis doloribus. Maiores necessitatibus fuga quae ad molestias modi recusandae neque maxime nobis ducimus sunt minus optio ullam ratione tenetur dignissimos non delectus doloribus quas, quaerat omnis voluptas quidem. Mollitia, exercitationem blanditiis libero incidunt velit nemo facilis maxime autem deserunt deleniti iusto possimus quisquam cumque molestiae suscipit porro eligendi sequi.</p>
          <p>We&apos;ve already added the button component for you.</p>
          <Button className="mt-2">Button</Button>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          (Press <kbd>d</kbd> to toggle dark mode)
        </div>
      </div>
    </div>
  )
}
