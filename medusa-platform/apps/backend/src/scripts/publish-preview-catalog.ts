import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, ProductStatus } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

type Catalog = {
  products: Array<{ slug: string; description: string; descriptionEn: string }>
}

export default async function publishPreviewCatalog({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const catalogPath = resolve(
    process.cwd(),
    "../../../references/TraeWEBTEST/assets/data/products.json"
  )
  const catalog = JSON.parse(await readFile(catalogPath, "utf8")) as Catalog
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "metadata"],
  })
  const target = products.filter((product) =>
    ["ember-guard", "stillwater", "the-stargazer"].includes(product.handle)
  )
  if (target.length !== 3) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Expected three ORBITAL products, found ${target.length}`
    )
  }

  await updateProductsWorkflow(container).run({
    input: {
      products: target.map((product) => ({
        id: product.id,
        status: ProductStatus.PUBLISHED,
        metadata: {
          ...product.metadata,
          ...(() => {
            const source = catalog.products.find((item) => item.slug === product.handle)
            return source
              ? { description_zh: source.description, description_en: source.descriptionEn }
              : {}
          })(),
          featured: true,
        },
      })),
    },
  })
  logger.info("Published the three existing ORBITAL preview products to the public catalog; purchases remain disabled.")
}
