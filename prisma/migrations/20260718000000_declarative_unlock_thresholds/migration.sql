-- Desbloqueos declarativos por cantidad de descubrimientos.
-- Element.unlockedAtDiscoveryCount: el elemento se desbloquea espontáneamente
-- cuando el jugador tiene al menos esta cantidad de PlayerDiscovery activos.
ALTER TABLE "Element" ADD COLUMN "unlockedAtDiscoveryCount" INTEGER;

-- Recipe.minimumDiscoveries: la receta solo puede usarse cuando el perfil
-- tiene al menos esta cantidad de elementos activos descubiertos.
ALTER TABLE "Recipe" ADD COLUMN "minimumDiscoveries" INTEGER NOT NULL DEFAULT 0;
