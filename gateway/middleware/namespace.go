package middleware

import (
	"Kairos/gateway/config"
	"Kairos/gateway/httpWriter"
	"net/http"
	"regexp"
)

var alphaNumRegex = regexp.MustCompile(`^[a-zA-Z0-9]+$`)

func Namespace(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		namespace, ok := ctx.Value(httpWriter.NamespaceKey{}).(string)

		if !ok {
			httpWriter.RespondWithError(w, 400, "Invalid Namespace")
			return
		}

		if namespace == "" {
			httpWriter.RespondWithError(w, 400, "No Namespace found")
			return
		}

		if !alphaNumRegex.MatchString(namespace) || len(namespace) > 63 {
			httpWriter.RespondWithError(w, 400, "Invalid Namespace")
			return
		}

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// NamespaceAllowlist bounds which client-asserted namespaces the shared service
// credential may select. X-Namespace is caller-asserted, so without this the
// credential reaches every namespace in the deployment; the allowlist is what
// binds that credential to a set of namespaces.
//
// An empty allowlist means "unrestricted", which config.LoadEnv only accepts
// outside production — so in production every namespace outside the list is
// refused rather than trusted.
func NamespaceAllowlist(envVar *config.Config) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(envVar.AllowedNamespaces))
	for _, namespace := range envVar.AllowedNamespaces {
		allowed[namespace] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if len(allowed) == 0 {
				next.ServeHTTP(w, r)
				return
			}

			namespace, _ := r.Context().Value(httpWriter.NamespaceKey{}).(string)
			if _, permitted := allowed[namespace]; !permitted {
				httpWriter.RespondWithError(w, 403, "Namespace not permitted")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
