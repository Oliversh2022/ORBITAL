import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const requestWithPublishableContext = req as MedusaRequest & {
    publishable_key_context?: { sales_channel_ids?: string[] }
  }
  const channelIds = requestWithPublishableContext.publishable_key_context?.sales_channel_ids ?? []
  if (!channelIds.length) {
    return res.status(401).json({
      type: "not_allowed",
      message: "A valid ORBITAL storefront publishable key is required.",
    })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "subtitle",
      "description",
      "handle",
      "thumbnail",
      "metadata",
      "sales_channels.id",
      "variants.id",
      "variants.title",
      "variants.sku",
      "variants.manage_inventory",
      "variants.allow_backorder",
      "variants.prices.*",
    ],
    filters: { status: "published" },
  })

  const products = data.filter((product) =>
    product.sales_channels?.some((channel) => Boolean(channel?.id && channelIds.includes(channel.id)))
  )

  return res.json({ products })
}
