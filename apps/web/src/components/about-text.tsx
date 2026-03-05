export function AboutText() {
  return (
    <section className="w-full flex flex-col">
      {/* Row 1 */}
      <div className="w-full py-[45px] sm:py-[62px] grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16">
        <h2 className="text-h5 text-foreground">
          <span>Fashion brands are investing more in sustainability than ever before.</span>{" "}
          <span className="text-foreground/40">
            The Digital Product Passport is the infrastructure to make that
            work visible. We're building the tools to get you there.
          </span>
        </h2>
        <div className="flex flex-col gap-4 text-small text-foreground/50">
          <p>
            Brands are making real progress on materials, sourcing, and
            production practices. But most of that effort stays invisible to
            the people buying the product. The EU's Digital Product Passport
            changes that. It gives brands a standardized way to share
            environmental impact data, material origins, and care information
            directly with consumers, at the product level.
          </p>
          <p>
            Most tools in this space treat the DPP as a compliance problem. They
            collect supply chain data, generate a document, and move on. The
            result is a digital passport that reads like a government form. Dense,
            unbranded, and ignored. If the goal is to help consumers make more
            conscious decisions, the passport needs to be something people
            actually want to read.
          </p>
          <p>
            Avelero exists because we believe environmental transparency
            should be accessible, well-designed, and built into the product
            from the start. Not bolted on as an afterthought. Not locked behind
            enterprise contracts. Available to every brand that wants to do
            this right.
          </p>
        </div>
      </div>

      {/* Row 2 */}
      <div className="w-full py-[45px] sm:py-[62px] grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16">
        <h2 className="text-h5 text-foreground">
          <span>We care deeply about the quality of our work</span>
        </h2>
        <div className="flex flex-col gap-4 text-small text-foreground/50">
          <p>
            A product passport is only useful if people engage with it. That
            means the design has to be good. Not good enough, but genuinely good.
            Typography, layout, color, spacing. Every passport generated through
            Avelero can be customized to feel like an extension of the brand it
            represents, not a third-party compliance page.
          </p>
          <p>
            On the data side, lifecycle environmental impact is the single
            hardest requirement for most brands to fill. Carbon footprint and
            water scarcity calculations typically require a separate LCA tool,
            a dedicated sustainability team, or both. We built a machine learning
            prediction engine directly into the platform that calculates these
            values from your material compositions and production data. No
            separate subscriptions. No five-figure consulting engagements.
          </p>
          <p>
            Speed matters too. Most DPP platforms require months of integration
            work across multiple teams. Avelero is designed to go live in days.
            Connect your product data, configure your design, generate your QR
            codes. The regulation is coming, and brands shouldn't need an
            enterprise budget or timeline to be ready for it.
          </p>
        </div>
      </div>

      {/* Row 3 */}
      <div className="w-full py-[45px] sm:py-[62px] grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16">
        <h2 className="text-h5 text-foreground">
          <span>Built in Amsterdam</span>
        </h2>
        <div className="flex flex-col gap-4 text-small text-foreground/50">
          <p>
            <strong>Rafaël Mevis</strong> · Co-founder. Five years of building
            products, with a background in fashion and computer science. Worked
            at an Amsterdam-based fashion brand where he first encountered the
            complexity of product sustainability data firsthand. Obsessed with
            design, raised by graphic designers, and driven by the conviction
            that environmental transparency tools should be as well-crafted as
            the products they represent.
          </p>
          <p>
            <strong>Moussa Ouallaf</strong> · Co-founder. ML engineer and
            computer scientist with a deep interest in physics, mathematics, and
            hard technical problems. Previously built machine learning systems at
            an Amsterdam-based startup. At Avelero, he architects the LCA
            prediction engine that makes product-level environmental impact
            calculations accessible without dedicated sustainability
            infrastructure.
          </p>
        </div>
      </div>
    </section>
  );
}
