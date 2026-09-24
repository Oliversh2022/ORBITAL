import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, ProductStatus } from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  createSalesChannelsWorkflow,
  createStoresWorkflow,
} from "@medusajs/medusa/core-flows"

type Catalog = {
  products: Array<{
    slug: string
    name: string
    nameEn: string
    description: string
    descriptionEn: string
    price: number
    currency: string
    materials: string[]
    intentions: string[]
    frontImage: string
    backImage: string
    availability: string
    sellable: boolean
  }>
}

export default async function seed({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const catalogPath = resolve(
    process.cwd(),
    "../../../references/TraeWEBTEST/assets/data/products.json"
  )
  const catalog = JSON.parse(await readFile(catalogPath, "utf8")) as Catalog

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: currentStores } = await query.graph({
    entity: "store",
    fields: ["id", "name"],
  })
  const stores = currentStores.length
    ? currentStores
    : (
        await createStoresWorkflow(container).run({
        input: {
          stores: [
            {
              name: "ORBITAL",
              supported_currencies: [{ currency_code: "cny", is_default: true }],
            },
          ],
        },
        })
      ).result

  const { data: currentChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  })
  const channels = currentChannels.length
    ? currentChannels
    : (
        await createSalesChannelsWorkflow(container).run({
        input: { salesChannelsData: [{ name: "ORBITAL 国际销售" }] },
        })
      ).result

  const { data: existing } = await query.graph({
    entity: "product",
    fields: ["handle"],
  })
  const existingHandles = new Set(existing.map((product) => product.handle))
  const products = catalog.products
    .filter((product) => !existingHandles.has(product.slug))
    .map((product) => ({
      title: product.name,
      handle: product.slug,
      subtitle: product.nameEn,
      description: `${product.description}\n\n${product.descriptionEn}`,
      status: ProductStatus.PUBLISHED,
      sales_channels: [{ id: channels[0].id }],
      metadata: {
        availability: product.availability,
        sellable: product.sellable,
        featured: true,
        description_zh: product.description,
        description_en: product.descriptionEn,
        materials: product.materials,
        intentions: product.intentions,
        storefront_images: [product.frontImage, product.backImage],
      },
      options: [{ title: "款式", values: ["标准款"] }],
      variants: [
        {
          title: "标准款",
          sku: `ORBITAL-${product.slug.toUpperCase().replaceAll("-", "_")}`,
          options: { 款式: "标准款" },
          prices: [{ currency_code: product.currency.toLowerCase(), amount: product.price }],
        },
      ],
    }))

  if (products.length) {
    await createProductsWorkflow(container).run({
      input: { products: products as never },
    })
  }

  logger.info(
    `ORBITAL seed complete: ${stores[0].name}, CNY only, ${products.length} draft products. No regions, shipping fees, or inventory were assumed.`
  )
}
